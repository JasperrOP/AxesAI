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
export const registerFace = async (req, res) => {
    try {
        const { frames } = req.body;
        if (!frames || !Array.isArray(frames) || frames.length === 0) {
            res.status(400).json({ message: 'Frames array is required' });
            return;
        }
        if (!req.user) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }
        const faceServiceUrl = process.env.FACE_SERVICE_URL || 'http://localhost:8001';
        const response = await fetch(`${faceServiceUrl}/register-face`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frames })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ detail: 'Failed to extract face embedding' }));
            res.status(response.status).json({ message: errData.detail || 'Face registration failed at microservice' });
            return;
        }
        const data = await response.json();
        await User.findByIdAndUpdate(req.user.id, { faceEmbedding: data.embedding });
        res.status(200).json({ message: 'Face registered successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Face registration failed', error: error.message });
    }
};
export const loginWithFace = async (req, res) => {
    try {
        const { email, frame } = req.body;
        if (!email || !frame) {
            res.status(400).json({ message: 'Email and frame are required' });
            return;
        }
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            res.status(401).json({ message: 'Invalid email or user not found' });
            return;
        }
        if (!user.faceEmbedding || user.faceEmbedding.length === 0) {
            res.status(400).json({ message: 'Face login has not been set up for this account' });
            return;
        }
        const faceServiceUrl = process.env.FACE_SERVICE_URL || 'http://localhost:8001';
        const response = await fetch(`${faceServiceUrl}/verify-face`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frame, storedEmbedding: user.faceEmbedding })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ detail: 'Failed to verify face' }));
            res.status(response.status).json({ message: errData.detail || 'Face verification failed at microservice' });
            return;
        }
        const data = await response.json();
        if (data.error) {
            res.status(401).json({ message: data.error });
            return;
        }
        if (!data.match) {
            res.status(401).json({ message: 'Face verification failed. Try again.' });
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
        res.status(500).json({ message: 'Face login failed', error: error.message });
    }
};
