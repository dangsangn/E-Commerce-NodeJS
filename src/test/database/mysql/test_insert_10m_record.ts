import mysql from 'mysql2'

const pool = mysql.createPool({
  host: 'localhost',
  port: 8811,
  user: 'root',
  password: 'root',
  database: 'test_large_db',
})

const batchSize = 100_000
const totalRecords = 10_000_000

let currentId = 1

async function createTable() {
  const sql = `
  CREATE DATABASE IF NOT EXISTS test_large_db;
  USE test_large_db;
  CREATE TABLE IF NOT EXISTS test_large_table (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    age INT,
    address VARCHAR(255)
  );`

  pool.query(sql, (error: any) => {
    if (error) {
      console.error('Error creating table:', error)
    } else {
      console.log('Table created successfully.')
    }
  })
}

async function insertBatch() {
  const records = []
  for (let i = 0; i < batchSize && currentId <= totalRecords; i++) {
    records.push([`Name ${currentId}`, currentId % 100, `Address ${currentId}`])
    currentId++
  }

  if (!records.length) {
    pool.end((error: any) => {
      if (error) {
        console.error('Error closing the pool:', error)
      } else {
        console.log('Pool closed successfully.')
      }
    })
    return
  }

  const sql = 'INSERT INTO test_large_table (name, age, address) VALUES ?'
  pool.query(sql, [records], async (error: any, results: any) => {
    if (error) {
      throw error
    }
    console.log(
      `Inserted batch of ${records.length} records, total inserted: ${results.affectedRows}`,
    )
    await insertBatch()
  })
}

insertBatch().catch((error) => {
  console.error('Error inserting records:', error)
})
