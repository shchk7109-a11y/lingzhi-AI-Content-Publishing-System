async function testMatrixAPI() {
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  const endpoint = `${baseUrl}/api/generate/matrix`;

  console.log(`Testing API at: ${endpoint}`);

  const samplePillars = [
    "药食同源新体验",
    "职场回血神器",
    "东方美学生活"
  ];

  console.log('\n--- Test: Generate Matrix with Sample Pillars ---');
  console.log('Input Pillars:', samplePillars);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pillars: samplePillars }),
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

testMatrixAPI();
