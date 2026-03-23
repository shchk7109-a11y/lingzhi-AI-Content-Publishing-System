// lib/knowledge.ts

// Shared types and default data structure.
// This file can be safely imported in both client and server components.

// --- Types ---

export interface BrandTasteAdvantage {
  core_positioning: string;
  vs_milk_tea: { summary: string; details: string[] };
  vs_traditional_herbal: { summary: string; details: string[] };
  technology_advantage: string;
  brand_promise: string;
}

export interface UniversalPersona {
  type: string;
  age: string;
  description: string;
  pain_points: string[];
  trigger: string;
}

export interface BrandInfo {
  name: string;
  story: string;
  vision: string;
  core_values: string[];
  taste_advantage?: BrandTasteAdvantage;
  universal_personas?: UniversalPersona[];
}

export interface FounderInfo {
  name: string;
  story: string;
  background: string;
}

export interface CustomerPersona {
  role: string;
  demographics: string;
  pain_points: string[];
  unsolved_reasons: string[];
  objections: string[];
  marketing_angles: string[];
}

export interface ProductTasteAdvantage {
  category_taste_advantage: string;
  core_selling_points: string[];
  key_phrases: string[];
  objection_handling: Record<string, string>;
}

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  ingredients: string;
  function: string;
  value_proposition: string;
  target_audience: string;
  personas: CustomerPersona[];
  taste_advantage?: ProductTasteAdvantage;
}

export interface KnowledgeBaseData {
  brand: BrandInfo;
  founder: FounderInfo;
  products: ProductItem[];
}

// --- Default Data (Fallback) ---
export const defaultData: KnowledgeBaseData = {
  brand: {
    name: "灵芝水铺 (Lingzhi Water Shop)",
    story: "结合传统中草药智慧与现代生活方式，打造新一代健康饮品。",
    vision: "让养生变得简单、时尚、日常化。",
    core_values: ["药食同源", "天然", "高效", "便捷"]
  },
  founder: {
    name: "创始人",
    story: "曾深受亚健康困扰的互联网高管，寻访名医后发现灵芝的神奇力量。",
    background: "拥有10年互联网产品经验，深知现代职场人的痛点。"
  },
  products: [
    {
      id: "1700000000001",
      name: "灵芝晚安水 (Lingzhi Sleep Water)",
      category: "草本茶饮",
      ingredients: "灵芝、酸枣仁、茯苓",
      function: "改善睡眠，安神助眠",
      value_proposition: "睡前一杯，自然好梦",
      target_audience: "失眠、焦虑的职场人",
      personas: [
        {
          role: "焦虑的互联网大厂员工",
          demographics: "25-35岁，女性，产品经理/运营，经常加班到深夜，喜欢瑜伽和冥想。",
          pain_points: [
            "入睡困难，躺在床上脑子还在转",
            "睡眠浅，一点声音就醒",
            "早起疲惫，感觉没睡够",
            "担心安眠药有副作用",
            "皮肤因为熬夜变得暗沉"
          ],
          unsolved_reasons: [
            "市面上的褪黑素吃了头晕",
            "没时间煮传统中药",
            "觉得养生茶太难喝",
            "不相信保健品",
            "生活压力大，无法通过心理调节解决"
          ],
          objections: [
            "真的有效吗？是不是智商税？",
            "味道会不会很苦？",
            "价格有点贵，不如喝牛奶",
            "喝了会不会第二天起不来？",
            "长期喝会不会有依赖性？"
          ],
          marketing_angles: [
            "针对'不敢吃药'的心理，强调'药食同源'的安全性",
            "打造'睡前仪式感'，配合冥想场景",
            "展示'早起好气色'的对比效果",
            "利用'成分党'视角解析灵芝多糖",
            "职场共鸣：'熬最晚的夜，补最贵的觉'"
          ]
        }
      ]
    }
  ]
};

// Legacy exports to avoid breaking if not used
export interface Frameworks {
  '3h': {
    hero: string;
    help: string;
    hatch: string;
  };
  pas: {
    problem: string;
    agitation: string;
    solution: string;
  };
}

export function getFrameworks(): Frameworks {
    return {
        '3h': {
            hero: 'Awareness',
            help: 'Education',
            hatch: 'Conversion'
        },
        pas: {
            problem: 'Problem',
            agitation: 'Agitation',
            solution: 'Solution'
        }
    };
}
