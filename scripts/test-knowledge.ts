import { defaultData, getFrameworks } from '../lib/knowledge';

console.log('--- Brand Info ---');
console.log(JSON.stringify(defaultData.brand, null, 2));

console.log('\n--- All Products ---');
console.log(JSON.stringify(defaultData.products, null, 2));

console.log('\n--- Frameworks ---');
console.log(JSON.stringify(getFrameworks(), null, 2));
