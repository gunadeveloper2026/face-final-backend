const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const apiHost = process.env.API_HOST || 'http://localhost:5000';
const baseURL = `${apiHost.replace(/\/$/, '')}/api`;
const api = axios.create({ baseURL, timeout: 20000 });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const USER_NAME = process.env.USER_NAME || 'Guna12';
const USER_EMAIL = process.env.USER_EMAIL || 'guna12@example.com';
const USER_PASSWORD = process.env.USER_PASSWORD || 'pass1234';

const loginAdmin = async () => {
  const res = await api.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  return res.data.token;
};

(async () => {
  try {
    console.log('Registering user...');
    const reg = await api.post('/auth/register', { name: USER_NAME, email: USER_EMAIL, password: USER_PASSWORD });
    console.log('Registered:', reg.data.user._id || reg.data.user.email);
  } catch (err) {
    console.warn('Register failed (maybe exists):', err.response?.data || err.message);
  }

  let token;
  try {
    console.log('Logging in admin...');
    token = await loginAdmin();
    console.log('Admin login succeeded');
  } catch (err) {
    console.error('Admin login failed:', err.response?.data || err.message);
    return;
  }

  try {
    console.log('Uploading enrollment image...');
    const form = new FormData();
    form.append('userId', USER_EMAIL);
    form.append('image', fs.createReadStream('../temp_enroll.png'));

    const res = await api.post('/face/enroll', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('Enroll response:', res.data);
  } catch (err) {
    console.error('Enroll failed:', err.response?.status, err.response?.data || err.message);
  }
})();
