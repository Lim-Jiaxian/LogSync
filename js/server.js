
import express from "express";
import Database from "better-sqlite3";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const db = new Database(
    path.join(__dirname, "../db/temp.db")
);

app.use(cors());
app.use(express.json());

app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    if (!username) {
        return res.status(400).json({
            success: false,
            message: "Please enter your username."
        });
    }

    const user = db.prepare(`
        SELECT user_id, username, role, station_id, password
        FROM users
        WHERE username = ?
    `).get(username.trim());

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Username not found."
        });
    }

    // Temporary development login:
    // Allow login only when the database password is empty
    if (password !== user.password) {
        return res.status(401).json({
            success: false,
            message: "Incorrect password."
        });
    }

    return res.json({
        success: true,
        message: "Login successful!",
        user: {
            user_id: user.user_id,
            username: user.username,
            role: user.role,
            station_id: user.station_id
        }
    });
});

app.listen(3000, () => {
    console.log("LogSync API running at http://localhost:3000");
});
