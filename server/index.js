const keys = require('./keys')

// Express app setup
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

const PORT = 5000
const app = express()
app.use(cors())
app.use(bodyParser.json())

// Postgres client setup
const { Pool } = require('pg')
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
})

pgClient.on('error', () => console.log('Lost Postgres connection!'))

pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch(error => console.log('error creating table:', error))

// Redis client setup
const redis = require('redis')
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
})

const redisPublisher = redisClient.duplicate()

// Express route handlers

app.get('/', (req, res) => {
  res.send('Hello')
})

app.get('/values/all',  async (req, res) => {
  const values = await pgClient.query('SELECT * FROM values')
  res.send(values.rows)
})

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values)
  })
})

app.post('/values', async (req, res) => {
  const index = req.body.index

  if (isNaN(index)) {
    return res.status(400).send('Index not a number')
  }

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high')
  }

  redisClient.hset('values', index, 'Nothing yet!')
  redisPublisher.publish('insert', index)
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index])

  res.send({
    working: true
  })
})

app.listen(PORT, error => {
  if (error) console.log('error in app.listen', error)
  console.log(`express server listening on port ${PORT}!`)
})