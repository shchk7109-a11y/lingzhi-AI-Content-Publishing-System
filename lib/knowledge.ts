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

export interface ContentExample {
  platform: 'xiaohongshu' | 'wechat' | 'video'
  content_type: string
  title: string
  content: string
  tags?: string[]
  note?: string
}

export interface KnowledgeBaseData {
  brand: BrandInfo;
  founder: FounderInfo;
  products: ProductItem[];
  examples?: ContentExample[];
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
  ],
  examples: [
    {
      platform: 'xiaohongshu',
      content_type: 'experience',
      title: '喝了两周这个草本茶，同事说我"气色开挂了" ☀️',
      content: "说实话一开始没抱期待\n就是觉得每天下午的奶茶该换换了\n\n第一口：嗯？不苦？？\n第二口：有回甘！像淡淡的甜水\n第三口：等等...这真的是灵芝做的？\n\n我是那种喝中药会皱眉头的人\n但这个真的完全没有中药感\n入口是清清爽爽的草本香\n咽下去之后嘴里会留一丝丝回甘\n\n喝了两周最直观的变化：\n✅ 下午不犯困了（以前三点必瘫）\n✅ 脸上那种暗黄的\"班味\"淡了\n✅ 最意外的是便秘居然也好转了\n\n我不是说它是神药啊\n就是当你把每天的奶茶换成这个\n身体会给你一些小惊喜\n\n📍南京 · 灵芝水铺\n本品为药食同源固体饮料，不能代替药物治疗。如有疾病，请及时就医。",
      tags: ["#灵芝水铺", "#草本茶饮", "#办公室养生", "#奶茶替代", "#南京探店"],
      note: "体验型标杆 - 口感三层描写法"
    },
    {
      platform: 'xiaohongshu',
      content_type: 'scenario',
      title: '周五下班路过灵芝水铺，给自己点一杯「收工茶」🍵',
      content: "这周真的被甲方折磨惨了\n周五最后一个会开完\n收拾东西下班 路过灵芝水铺\n\n推门进去 点了杯清脂纤纤\n接过来的时候闻到一股淡淡的草本香\n不浓不烈 刚刚好\n像是有人跟你说\"辛苦了 歇歇吧\"\n\n我管这叫「收工茶」\n因为喝上这杯 这周就算正式结束了\n\n配方里有灵芝、荷叶、山楂\n本来是帮助祛湿的\n但我更享受的是这个下班仪式感\n\n你们下班后的第一杯是什么？\n\n本品为药食同源固体饮料，不能代替药物治疗。",
      tags: ["#下班仪式感", "#灵芝水铺", "#职场人的养生", "#周五快乐"],
      note: "场景型标杆 - 到店消费仪式感"
    },
    {
      platform: 'wechat',
      content_type: 'scenario',
      title: '加班后的外卖草本茶',
      content: "今天加班到八点半\n下楼取了杯外卖的草本茶\n等回过神来发现已经喝完了\n\n比奶茶清爽 但又不是白开水那种无聊\n有淡淡的回甘\n就很舒服\n\n（配图：外卖杯+键盘+台灯的桌面）\n本品为药食同源固体饮料，不能代替药物治疗。",
      note: "朋友圈标杆 - 外卖场景，64字"
    },
    {
      platform: 'wechat',
      content_type: 'experience',
      title: '闺蜜推荐的灵芝水',
      content: "闺蜜推荐的灵芝水 喝了一个月\n没变仙女 但早上起来脸确实没那么肿了\n而且真的不苦 有点像淡甜水\n\n（配图：素颜自拍+产品杯）\n本品为药食同源固体饮料，不能代替药物治疗。",
      note: "朋友圈标杆 - 48字，真实不夸张"
    },
    {
      platform: 'video',
      content_type: 'taste',
      title: '闺蜜逼我喝的"中药水"，打脸了 💀',
      content: "黄金3秒钩子：她说这是灵芝做的，我以为我要嘎了\n\n场景1（0-3秒）\n画面：闺蜜递过一杯深色饮品（门店出品的杯装），镜头怼脸，表情夸张的嫌弃\n口播：她说这是灵芝做的...我以为我要嘎了\n字幕：闺蜜说这杯\"灵芝水\"超好喝\n\n场景2（3-12秒）\n画面：犹豫接过杯子，慢慢凑近闻，表情从嫌弃变好奇\n口播：（闻）嗯？没有中药味啊...（小口喝）等等...这是什么？\n字幕：闻起来是淡淡的草本香？\n\n场景3（12-22秒）\n画面：连喝几口，表情逐渐变成惊喜，转头看闺蜜\n口播：不苦？？有回甘？？这确定是灵芝做的？？比我平时喝的果茶还顺口！\n字幕：无苦涩 有回甘 像淡甜水\n\n场景4（22-30秒）\n画面：两人举杯，产品正面特写3秒（门店logo杯）\n口播：好吧...是我格局小了。灵芝水铺，收下我的膝盖\n字幕：灵芝水铺 · 良药与甜品的和解\n口播（快速）：药食同源固体饮料，不能代替药物",
      note: "短视频标杆 - 口感体验30秒，门店场景"
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
