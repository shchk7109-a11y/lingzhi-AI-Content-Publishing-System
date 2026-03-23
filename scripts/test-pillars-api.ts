async function testPillarsAPI() {
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  const endpoint = `${baseUrl}/api/generate/pillars`;

  console.log(`Testing API at: ${endpoint}`);

  // Test 1: Brand Mode
  console.log('\n--- Test 1: Brand Mode ---');
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'brand' }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Success:', JSON.stringify(data, null, 2));
    } else {
      console.error('Error:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Fetch failed:', error);
  }

  // Test 2: Product Mode
  console.log('\n--- Test 2: Product Mode (Herbal Coffee) ---');
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'product', productId: 'Herbal Coffee' }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Success:', JSON.stringify(data, null, 2));
    } else {
      console.error('Error:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Fetch failed:', error);
  }
}

testPillarsAPI();
