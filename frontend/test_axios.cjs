const axios = require('axios');
const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
  headers: { 'Content-Type': 'application/json' },
});

async function test() {
  try {
    const response = await api.get(`properties/6/`);
    console.log("SUCCESS:", response.status, response.data.title);
  } catch (error) {
    if (error.response) {
      console.log("ERROR STATUS:", error.response.status);
    } else {
      console.log("NETWORK ERROR:", error.message);
    }
  }
}
test();
