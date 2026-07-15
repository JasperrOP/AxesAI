import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
const SALT_ROUNDS = 10;
export const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password || !role) {
            res.status(400).json({ message: 'All fields (name, email, password, role) are required' });
            return;
        }
        const normalizedRole = role.toLowerCase().trim();
        if (normalizedRole !== 'teacher' && normalizedRole !== 'student') {
            res.status(400).json({ message: 'Invalid role. Must be teacher or student' });
            return;
        }
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            res.status(400).json({ message: 'Email already registered' });
            return;
        }
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const newUser = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash,
            role: normalizedRole,
        });
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                createdAt: newUser.createdAt,
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
};
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: 'Email and password are required' });
            return;
        }
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }
        if (!user.passwordHash) {
            res.status(401).json({ message: 'Account does not have a password configured.' });
            return;
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }
        const secret = process.env.JWT_SECRET || 'fallback_secret_for_development';
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, secret, { expiresIn: '2h' });
        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
};
