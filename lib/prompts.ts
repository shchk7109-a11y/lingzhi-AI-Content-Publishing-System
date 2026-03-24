import fs from 'fs';
import path from 'path';

export interface PromptsConfig {
  pillars_system: string;
  pillars_user: string;
  matrix_system: string;
  matrix_user: string;
  topics_system: string;
  topics_user: string;
  topics_system_xhs: string;
  topics_user_xhs: string;

  // Scripts - Split by platform
  scripts_system_xhs: string;
  scripts_system_wechat: string;
  scripts_system_video: string;
  scripts_user: string;
  
  // Skills
  skills_xhs: string;
  skills_wechat: string;
  skills_video: string;
}

const PROMPTS_FILE_PATH = path.join(process.cwd(), 'data', 'prompts.json');

// DEFAULT PROMPTS (Version 4.0: Split Script Systems)
export const defaultPrompts: PromptsConfig = {
  // --- STEP 1: PILLARS ---
  pillars_system: `你是一个资深的内容营销策略专家。
你的任务是为品牌或产品提炼 3 个核心的“内容营销支柱” (Content Pillars)。

内容支柱是品牌在社交媒体上长期沟通的核心话题方向。
它们应该：
1. **与产品强相关**：必须结合产品的核心功效和配方成分。
2. **与受众强共鸣**：必须解决目标受众的具体痛点或满足其愿望。
3. **差异化**：体现品牌的独特价值主张。

**输出要求：**
返回一个 JSON 对象，包含 key "pillars"，它是一个字符串数组，包含 3 个简短有力的话题名称（例如：“职场养生指南”、“灵芝成分党”、“国潮新生活”）。`,

  pillars_user: `当前模式：{{mode}}

**上下文信息：**
{{context}}

**核心配方 (Ingredients):**
{{ingredients}}

**目标受众 (Target Audience):**
{{target_audience}}

请基于以上信息，生成 3 个最适合的内容营销支柱。`,

  // --- STEP 2: MATRIX ---
  matrix_system: `你是一个资深的内容营销策略专家。
你的任务是为品牌制定一份可执行的“支柱内容9宫格策略矩阵”。

这份矩阵用于指导品牌针对目标客户围绕哪些内容进行创作。
它包含两个维度：

**X轴：内容形式 (Content Formats)**
1. **增长内容 (Growth Content)**: 吸引眼球，爆红潜力，面向初学者，利用人类恐惧/欲望，承诺快速解决方案。
2. **知识内容 (Knowledge Content)**: 获取粉丝，教育受众，深入解决特定问题，针对更具体的受众。
3. **权威内容 (Authority Content)**: 建立信任，展示专业知识，提供社会证明，让受众信任你。

**Y轴：话题支柱 (Topic Pillars)**
即用户提供的 3 个核心营销支柱。

**必须结合产品配方 (Ingredients)：**
如果提供了产品配方，请在策略中明确提及核心成分及其功效，建立专业壁垒。

**输出要求：**
请生成一个 JSON 对象，包含 key "matrix"，它是一个数组，每个元素代表一行（对应一个 Pillar）。
每行包含：
- pillar: 支柱名称
- growth: { title: "加粗标题", explanation: "两句解释策略", ideas: ["创意1", "创意2"] }
- knowledge: { title: "加粗标题", explanation: "两句解释策略", ideas: ["创意1", "创意2"] }
- authority: { title: "加粗标题", explanation: "两句解释策略", ideas: ["创意1", "创意2"] }

语言：简体中文。`,

  matrix_user: `当前模式：{{mode}}

核心上下文 (Context):
{{context}}

目标客户画像 (Personas):
{{personas_context}}

产品配方 (Ingredients):
{{ingredients}}

Y轴 - 3个话题支柱:
1. {{pillar1}}
2. {{pillar2}}
3. {{pillar3}}

请开始生成。`,

  // --- STEP 3: TOPICS ---
  topics_system: `You are a social media content expert for "{{brand_name}}".
Your task is to generate content topics based on the provided "9-Grid Content Matrix" and the specific **Platform Skills** below.

{{platform_skills}}

**Input Data:**
A 9-grid matrix where each row is a "Pillar" and columns are "Growth", "Knowledge", "Authority".

**Output Requirement:**
For EACH cell in the matrix (Pillar x Strategy), generate a list of topics.
{{quantity_instruction}}

**Return Format (JSON):**
{
  "topics": {
    "Pillar Name": {
      "growth": ["Topic 1", ...],
      "knowledge": ["Topic 1", ...],
      "authority": ["Topic 1", ...]
    }
  }
}

Language: Simplified Chinese.`,

  topics_user: `Generate {{platform}} topics for this matrix:
{{matrix_json}}`,

  // --- STEP 3b: XHS-SPECIFIC TOPICS ---
  topics_system_xhs: '', // 实际值从 data/prompts.json 读取
  topics_user_xhs: '', // 实际值从 data/prompts.json 读取

  // --- SKILLS ---
  skills_xhs: `**Platform: Xiaohongshu (Red Note) Skills**

**核心策略：痛点+成分+情绪**
你生成的每一个标题，都必须尝试解决一个具体的用户痛点。

**输入素材参考：**
- 核心成分：{{ingredients}}
- 用户痛点池：(AI请根据产品知识库自动联想相关痛点，如熬夜脸、水肿、便秘、焦虑)

**爆款标题公式（请灵活运用）：**
1. **场景+痛点**： "早八人救命！消肿去黄真的牛！"
2. **成分+功效**： "灵芝+黑咖？这杯中式美式我也悟了！"
3. **情绪+反差**： "被同事问疯了...真的只是喝了这个！"
4. **拒绝体**： "别再喝糖水了！这才是职场人的续命水。"

**要求：**
- 语气：真实分享，像闺蜜聊天。
- 必须包含 Emoji。
- 必须结合矩阵中的策略方向（Growth/Knowledge/Authority）。`,

  skills_wechat: `**Platform: WeChat Moments (Friend Circle) Skills**

**核心策略：人设信任 + 生活场景 + 软植入**
文案必须读起来像是一个真实朋友的深夜感悟或下午茶分享，而不是官方广告。

**内容维度：**
1. **真实反馈**：引用客户的原话（"昨晚有个老客说..."）。
2. **成分科普**：用大白话讲配方（"别看这杯黑乎乎的，里面的灵芝可是..."）。
3. **生活场景**：加班、开会、带娃、应酬后的真实状态。

**输入素材结合：**
- 结合 {{ingredients}} 强调真材实料（"不加一滴糖，全是草本原本的味道"）。
- 针对用户痛点（如熬夜、疲惫）提供情绪价值。

**格式要求：**
- **短文案**：通常不超过 100 字，分段清晰。
- **神转折**：前面讲生活，最后一句轻描淡写带出产品。
- **互动钩子**：文案末尾引导点赞或私信（"懂的来"、"老规矩"）。`,

  skills_video: `**Platform: Short Video (TikTok/Douyin) Skills**

**核心策略：视觉钩子 + 痛点放大 + 情绪反转**
生成的标题（钩子）必须在 0.5 秒内抓住用户注意力。

**钩子类型 (Hooks)：**
1. **视觉冲击**："这杯黑水，救了我的熬夜脸？！" (展示对比)
2. **认知反差**："灵芝+咖啡？中药铺子要卷死星巴克？"
3. **痛点直击**："凌晨2点还在改PPT？这一杯比红牛管用！"
4. **成分揭秘**："扒一扒这杯‘回血水’里到底放了什么猛料...{{ingredients}}"

**要求：**
- 极度口语化，短促有力。
- 必须结合 {{ingredients}} 制造悬念（"原来是加了它..."）。
- 针对痛点（水肿、疲劳、油腻）给出即时满足的承诺。`,

  // --- STEP 4: SCRIPTS (Split) ---
  scripts_system_xhs: '', // 实际值从 data/prompts.json 读取（小红书50万粉博主人设 + Anti-Patterns + 参考范文）

  scripts_system_wechat: '', // 实际值从 data/prompts.json 读取（朋友圈真实普通人视角 + 80字上限）

  scripts_system_video: '', // 实际值从 data/prompts.json 读取（短视频脚本 + 创始人素材库 + 秒数区间）

  scripts_user: '' // 实际值从 data/prompts.json 读取（含策略上下文：支柱/内容类型/策略方向）
};

export function getPrompts(): PromptsConfig {
  try {
    if (fs.existsSync(PROMPTS_FILE_PATH)) {
      const fileContent = fs.readFileSync(PROMPTS_FILE_PATH, 'utf-8');
      const data = JSON.parse(fileContent);
      // Merge with default to ensure new keys exist if file is old
      return { ...defaultPrompts, ...data };
    }
  } catch (error) {
    console.error("Error reading prompts:", error);
  }
  return defaultPrompts;
}

export function savePrompts(data: PromptsConfig): boolean {
  try {
    const dir = path.dirname(PROMPTS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PROMPTS_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error("Error saving prompts:", error);
    return false;
  }
}
