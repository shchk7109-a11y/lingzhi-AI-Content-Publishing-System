import fs from 'fs';
import path from 'path';

const USERS_FILE_PATH = path.join(process.cwd(), 'data', 'users.json');

// 默认管理员账号（生产环境首次启动时自动创建）
const DEFAULT_ADMIN: User = {
  id: '1771906620639',
  username: '248492610@qq.com',
  passwordHash: '95kaiw03',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: '2026-02-24T04:17:00.639Z',
};

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'PENDING' | 'REJECTED';
  createdAt: string;
}

function ensureDataDir() {
  const dir = path.dirname(USERS_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getAllUsers(): User[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(USERS_FILE_PATH)) {
      // 文件不存在，写入默认管理员并返回
      fs.writeFileSync(USERS_FILE_PATH, JSON.stringify([DEFAULT_ADMIN], null, 2), 'utf-8');
      console.log('[users-db] 初始化默认管理员账号');
      return [DEFAULT_ADMIN];
    }
    const content = fs.readFileSync(USERS_FILE_PATH, 'utf-8').trim();
    if (!content || content === '[]' || content === '') {
      // 文件为空或空数组，写入默认管理员
      fs.writeFileSync(USERS_FILE_PATH, JSON.stringify([DEFAULT_ADMIN], null, 2), 'utf-8');
      console.log('[users-db] users.json 为空，初始化默认管理员账号');
      return [DEFAULT_ADMIN];
    }
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading users:", error);
    return [DEFAULT_ADMIN];
  }
}

export function saveAllUsers(users: User[]): boolean {
  try {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error("Error saving users:", error);
    return false;
  }
}

export function createUser(user: User): boolean {
  const users = getAllUsers();
  users.push(user);
  return saveAllUsers(users);
}

export function findUserByUsername(username: string): User | undefined {
  const users = getAllUsers();
  return users.find(u => u.username === username);
}

export function updateUser(id: string, updates: Partial<User>): User | null {
  const users = getAllUsers();
  const index = users.findIndex(u => u.id === id);
  
  if (index === -1) return null;
  
  const updatedUser = { ...users[index], ...updates };
  users[index] = updatedUser;
  
  if (saveAllUsers(users)) {
    return updatedUser;
  }
  return null;
}

export function countUsers(): number {
  return getAllUsers().length;
}
