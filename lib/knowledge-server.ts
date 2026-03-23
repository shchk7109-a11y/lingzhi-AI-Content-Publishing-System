import fs from 'fs';
import path from 'path';
import { KnowledgeBaseData, defaultData } from './knowledge';

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'knowledge_base.json');

export function getKnowledgeBase(): KnowledgeBaseData {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const fileContent = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      const data = JSON.parse(fileContent);
      return { ...defaultData, ...data };
    }
  } catch (error) {
    console.error("Error reading knowledge base:", error);
  }
  return defaultData;
}

export function saveKnowledgeBase(data: KnowledgeBaseData): boolean {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error("Error saving knowledge base:", error);
    return false;
  }
}

export function getBrandInfo() {
  return getKnowledgeBase().brand;
}

export function getFounderInfo() {
  return getKnowledgeBase().founder;
}

export function getProducts() {
  return getKnowledgeBase().products;
}
