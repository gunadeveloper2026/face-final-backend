const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

(async ()=>{
  const api = axios.create({ baseURL: 'http://localhost:5001/api' });
  try {
    console.log('Registering user...');
    const reg = await api.post('/auth/register', { name: 'Guna12', email: 'guna12@example.com', password: 'pass1234' });
    console.log('Registered:', reg.data.user._id || reg.data.user.email);
  } catch (err) {
    console.warn('Register failed (maybe exists):', err.response?.data || err.message);
  }

  try {
    console.log('Uploading enrollment image...');
    const form = new FormData();
    form.append('userId', 'Guna12');
    form.append('image', fs.createReadStream('../temp_enroll.png'));
    const res = await api.post('/face/enroll', form, { headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity });
    console.log('Enroll response:', res.data);
  } catch (err) {
    console.error('Enroll failed:', err.response?.status, err.response?.data || err.message);
  }
})();
