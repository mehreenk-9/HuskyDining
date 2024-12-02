import express from 'express';
import { getStudent, getStudents, addStudent, updateStudent, deleteStudent } from './server.js';
import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
}).promise();

const app = express();

app.use(express.json());

app.get('/students', async (req, res) => {
    const notes = await getStudents();
    res.send(notes);
});

app.get('/students/:peoplesoft', async (req, res) => {
    const peoplesoft = req.params.peoplesoft;
    const student = await getStudent(peoplesoft);
    res.send(student);
});

// Add a new student
app.post('/students', async (req, res, next) => {
    try {
        const { netid, name, points, flex_passes } = req.body;
        const newStudentId = await addStudent({ netid, name, points, flex_passes });
        res.status(201).json({ message: 'Student added successfully', id: newStudentId });
    } catch (err) {
        next(err);
    }
});

// Update a student's points and flex passes
app.put('/students/:peoplesoft', async (req, res, next) => {
    try {
        const peoplesoft = req.params.peoplesoft;
        const { points, flex_passes } = req.body;
        const affectedRows = await updateStudent(peoplesoft, { points, flex_passes });
        if (affectedRows) {
            res.json({ message: 'Student updated successfully' });
        } else {
            res.status(404).json({ message: 'Student not found' });
        }
    } catch (err) {
        next(err);
    }
});

// Delete a student
app.delete('/students/:peoplesoft', async (req, res, next) => {
    try {
        const peoplesoft = req.params.peoplesoft;
        const affectedRows = await deleteStudent(peoplesoft);
        if (affectedRows) {
            res.json({ message: 'Student deleted successfully' });
        } else {
            res.status(404).json({ message: 'Student not found' });
        }
    } catch (err) {
        next(err);
    }
});

// Process a donation
app.post('/donations', async (req, res, next) => {
    try {
        const { netid, donationType, amount } = req.body;
        if (!netid || !donationType || !amount) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        if (donationType === 'points') {
            await pool.query(
                `UPDATE students SET points = points + ? WHERE netid = ?`,
                [amount, netid]
            );
        } else if (donationType === 'flexPass') {
            await pool.query(
                `UPDATE students SET flex_passes = flex_passes + ? WHERE netid = ?`,
                [amount, netid]
            );
        } else {
            return res.status(400).json({ message: 'Invalid donation type' });
        }

        // Log the donation in the transactions table
        await pool.query(
            `INSERT INTO transactions (netid, transaction_type, amount)
             VALUES (?, ?, ?)`,
            [netid, donationType, amount]
        );

        res.status(201).json({ message: 'Donation successful' });
    } catch (err) {
        next(err);
    }
});

// Get donation history for a user
app.get('/donations/:netid', async (req, res, next) => {
    try {
        const netid = req.params.netid;
        const [history] = await pool.query(
            `SELECT transaction_type, amount, transaction_date
             FROM transactions
             WHERE netid = ?
             ORDER BY transaction_date DESC`,
            [netid]
        );
        res.json(history);
    } catch (err) {
        next(err);
    }
});

// Error-handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something broke!', error: err.message });
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
