import axios from 'axios';
console.log(axios.getUri({ baseURL: 'http://127.0.0.1:8000/api/', url: '/properties/6/' }));
console.log(axios.getUri({ baseURL: 'http://127.0.0.1:8000/api', url: '/properties/6/' }));
console.log(axios.getUri({ baseURL: 'http://127.0.0.1:8000/api', url: 'properties/6/' }));
