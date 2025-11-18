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
  // Acessamos a chave de forma segura para evitar erros em tempo de execução
  let apiKey = '';
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      apiKey = process.env.API_KEY;
    } else if (typeof window !== 'undefined' && (window as any).process && (window as any).process.env && (window as any).process.env.API_KEY) {
        // Fallback explícito para window.process
        apiKey = (window as any).process.env.API_KEY;
    }
  } catch (e) {
    console.warn("Aviso: Não foi possível acessar as variáveis de ambiente.", e);
  }

  if (!apiKey) {
    console.error("ERRO CRÍTICO: API_KEY não encontrada em process.env");
    throw new Error("Chave de API não configurada. No Vercel, certifique-se de adicionar a variável 'API_KEY' (ou 'VITE_API_KEY') nas configurações do projeto e fazer um REDEPLOY.");
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