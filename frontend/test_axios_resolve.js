import axios from 'axios';
const api1 = axios.create({ baseURL: 'http://127.0.0.1:8000/api' });
console.log("No trailing slash in baseURL:", api1.getUri({url: 'properties/6/'}));

const api2 = axios.create({ baseURL: 'http://127.0.0.1:8000/api/' });
console.log("Trailing slash in baseURL:", api2.getUri({url: 'properties/6/'}));
