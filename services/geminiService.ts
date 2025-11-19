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
  
  // Tenta recuperar a chave de API.
  // Prioridade: 1. import.meta.env.VITE_API_KEY (Padrão Vite)
  //             2. process.env.VITE_API_KEY (Fallback Vercel)
  //             3. process.env.API_KEY (Fallback genérico)
  
  let rawApiKey = '';

  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      rawApiKey = import.meta.env.VITE_API_KEY;
  } 
  // @ts-ignore
  else if (typeof process !== 'undefined' && process.env) {
       // @ts-ignore
       rawApiKey = process.env.VITE_API_KEY || process.env.API_KEY || '';
  }

  // Limpeza da chave: remove espaços em branco e aspas acidentais que podem ocorrer ao copiar/colar no Vercel
  const apiKey = rawApiKey ? rawApiKey.trim().replace(/^["']|["']$/g, '') : '';

  console.log("Status da API Key:", apiKey ? "Presente" : "Ausente", apiKey ? `(Começa com: ${apiKey.substring(0, 4)}...)` : "");

  if (!apiKey) {
    throw new Error(
        "CHAVE DE API NÃO ENCONTRADA.\n\n" +
        "No Vercel:\n" +
        "1. Defina a variável de ambiente 'VITE_API_KEY'.\n" +
        "2. Vá em Deployments > Redeploy para aplicar."
    );
  }

  // Validação básica de formato do Google (Geralmente começam com AIza)
  if (!apiKey.startsWith('AIza')) {
      throw new Error(
          `A chave de API configurada parece inválida (não começa com 'AIza').\n` +
          `Valor atual detectado (início): '${apiKey.substring(0, 5)}...'\n` +
          `Verifique no Vercel se você não copiou o 'Project ID' ou colou caracteres estranhos.`
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
    
    if (error.message && (error.message.includes("400") || error.message.includes("API_KEY_INVALID"))) {
        throw new Error("Erro de Autenticação (400): A chave de API foi recusada pelo Google. Verifique no Vercel se a chave está correta e não possui espaços extras.");
    }

    if (error.message && error.message.includes("SAFETY")) {
         throw new Error("A análise foi bloqueada por políticas de segurança. Tente uma imagem diferente.");
    }
    throw new Error(error.message || "Não foi possível analisar o extrato.");
  }
};
