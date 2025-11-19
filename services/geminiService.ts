import { GoogleGenAI, Type } from "@google/genai";
import type { GeminiResponse } from '../types';

const schema = {
    type: Type.OBJECT,
    properties: {
        clientName: {
            type: Type.STRING,
            description: "O nome completo do titular da conta, conforme encontrado no extrato."
        },
        positiveEntries: {
            type: Type.ARRAY,
            description: "Lista de todas as transações de crédito (valores positivos) encontradas no extrato que representam receita real.",
            items: {
                type: Type.OBJECT,
                properties: {
                    description: {
                        type: Type.STRING,
                        description: "A descrição da transação de crédito (ex: 'SALARIO', 'TRANSF PIX', 'DEPOSITO')."
                    },
                    amount: {
                        type: Type.NUMBER,
                        description: "O valor numérico da transação de crédito."
                    },
                    date: {
                        type: Type.STRING,
                        description: "A data em que a transação ocorreu, no formato AAAA-MM-DD."
                    }
                },
                required: ["description", "amount", "date"]
            }
        }
    },
    required: ["clientName", "positiveEntries"]
};

export const analyzeStatement = async (base64Image: string, mimeType: string): Promise<GeminiResponse> => {
  
  // Tenta recuperar a chave de API de todas as formas possíveis suportadas pelo Vite e Vercel.
  // IMPORTANTE: O acesso DEVE ser explícito (ponto notation) para que o Vite faça o replace no build.
  let apiKey = '';

  try {
      // 1. Padrão Vite (Obrigatório uso de VITE_ no prefixo para exposição no client-side)
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
          // @ts-ignore
          apiKey = import.meta.env.VITE_API_KEY;
      }
      // 2. Fallback para API_KEY direta (caso alguma config específica de define no vite.config exponha isso)
      // @ts-ignore
      else if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.API_KEY) {
          // @ts-ignore
          apiKey = import.meta.env.API_KEY;
      }
      // 3. Fallback para process.env (Node ou compatibilidade)
      // @ts-ignore
      else if (typeof process !== 'undefined' && process.env && process.env.VITE_API_KEY) {
          // @ts-ignore
          apiKey = process.env.VITE_API_KEY;
      }
      // @ts-ignore
      else if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
          // @ts-ignore
          apiKey = process.env.API_KEY;
      }
  } catch (err) {
      console.error("Erro ao ler variáveis de ambiente:", err);
  }

  // Log para depuração no console do navegador (F12)
  if (!apiKey) {
      console.warn("GeminiService: Nenhuma API Key encontrada nas variáveis de ambiente.");
      console.log("Verificando import.meta.env:", (import.meta as any)?.env);
  } else {
      console.log("GeminiService: API Key carregada com sucesso (inicia com " + apiKey.substring(0, 4) + "...)");
  }

  if (!apiKey) {
    throw new Error(
        "CHAVE DE API NÃO ENCONTRADA.\n\n" +
        "Instruções para corrigir no Vercel:\n" +
        "1. Vá em 'Settings' > 'Environment Variables'.\n" +
        "2. Adicione (ou edite) a chave com o nome: 'VITE_API_KEY'.\n" +
        "3. O valor deve ser sua chave 'AIza...'.\n" +
        "4. IMPORTANTE: Vá na aba 'Deployments', clique nos 3 pontos do último deploy e selecione 'REDEPLOY'.\n\n" +
        "Sem o Redeploy, a nova variável não é incorporada ao site."
    );
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });

  const prompt = `
    Você é um assistente financeiro especialista em análise de extratos bancários brasileiros.
    Analise o documento do extrato bancário fornecido (pode ser uma imagem ou PDF).
    Sua primeira tarefa é identificar o nome completo do titular da conta (cliente) e extraí-lo.
    Sua segunda tarefa é identificar e extrair TODAS as transações que representam uma entrada de dinheiro (crédito), como depósitos, transferências recebidas (PIX, TED), salários, ou qualquer valor positivo.
    Para cada transação, extraia a descrição, o valor e a data no formato AAAA-MM-DD.
    
    IMPORTANTE: Para o campo 'amount', você deve fornecer um valor numérico puro. Extratos brasileiros usam vírgula como separador decimal e ponto para milhares (ex: 'R$ 1.234,56'). Você DEVE converter este formato para um número JSON válido, como 1234.56. Remova o símbolo 'R$' e qualquer formatação de moeda.
    
    REGRAS DE EXCLUSÃO:
    1. Ignore completamente todas as saídas (débitos), como pagamentos, saques, compras no débito ou transferências enviadas.
    2. Ignore especificamente transações de crédito que sejam resgates de aplicações financeiras (por exemplo, com descrições como "RESGATE APLICACAO", "RESGATE CDB", ou "resgates de aplicações financeira RBD"). Essas não são novas receitas e não devem ser incluídas na lista de 'positiveEntries'.
    3. Ignore transações de crédito que sejam transferências da mesma titularidade (do próprio cliente para ele mesmo). Uma vez que você identificou o nome do cliente ('clientName'), ignore quaisquer transações PIX ou TED recebidas onde o remetente é o próprio titular da conta. Descrições comuns para isso incluem 'TRANSF MESMA TITULARIDADE', 'TED C', ou quando o nome do remetente na descrição da transação é o mesmo que 'clientName'. Essas não representam nova receita.
    
    Apenas se concentre nos valores de CRÉDITO que representam receita real de TERCEIROS.
    Retorne os dados estritamente no formato JSON solicitado, contendo o 'clientName' e uma lista de 'positiveEntries'.
    Se não houver transações de crédito válidas, retorne uma lista vazia para 'positiveEntries', mas ainda tente fornecer o 'clientName'. Se o nome do cliente não puder ser encontrado, retorne uma string vazia para 'clientName'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const jsonText = response.text.trim();
    const parsedJson: GeminiResponse = JSON.parse(jsonText);
    
    // Basic validation
    if (!parsedJson || typeof parsedJson.clientName === 'undefined' || !Array.isArray(parsedJson.positiveEntries)) {
        throw new Error("A resposta da IA não continha a estrutura esperada (clientName e positiveEntries).");
    }
    
    return parsedJson;
  } catch (error: any) {
    console.error("Erro na API Gemini:", error);
    if (error.message && error.message.includes("SAFETY")) {
         throw new Error("A análise foi bloqueada por políticas de segurança. Tente uma imagem diferente.");
    }
    throw new Error(error.message || "Não foi possível analisar o extrato.");
  }
};