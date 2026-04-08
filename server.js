const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const instanceId = process.env.INSTANCE_ID || 'unknown';
const privateIp = process.env.PRIVATE_IP || 'unknown';

async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

async function ensureTable() {
  const conn = await getConnection();
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(120) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await conn.end();
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', instanceId, privateIp });
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Automation with Terraform</title></head>
      <body style="font-family:Arial,sans-serif;max-width:800px;margin:40px auto;line-height:1.6">
        <h1>Automation with Terraform</h1>
        <p>Node.js app via Docker is running.</p>
        <ul>
          <li><b>Instance ID:</b> ${instanceId}</li>
          <li><b>Private IP:</b> ${privateIp}</li>
        </ul>
        <h3>Quick test endpoints</h3>
        <ul>
          <li><a href="/health">/health</a></li>
          <li><a href="/users">/users</a></li>
        </ul>
        <p>Use Postman for POST, PUT, and DELETE testing.</p>
      </body>
    </html>
  `);
});

app.get('/users', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.execute('SELECT * FROM users ORDER BY id DESC');
    await conn.end();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.execute('SELECT * FROM users WHERE id = ?', [req.params.id]);
    await conn.end();
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/users', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ message: 'name and email are required' });
  try {
    const conn = await getConnection();
    const [result] = await conn.execute('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
    await conn.end();
    res.status(201).json({ id: result.insertId, name, email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/users/:id', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ message: 'name and email are required' });
  try {
    const conn = await getConnection();
    const [result] = await conn.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.params.id]);
    await conn.end();
    if (!result.affectedRows) return res.status(404).json({ message: 'User not found' });
    res.json({ id: Number(req.params.id), name, email, updated: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/users/:id', async (req, res) => {
  try {
    const conn = await getConnection();
    const [result] = await conn.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    await conn.end();
    if (!result.affectedRows) return res.status(404).json({ message: 'User not found' });
    res.json({ id: Number(req.params.id), deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, async () => {
  try {
    await ensureTable();
    console.log(`App listening on port ${port}`);
  } catch (error) {
    console.error('Startup failed:', error.message);
  }
});
