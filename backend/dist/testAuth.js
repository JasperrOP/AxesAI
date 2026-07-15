const runTest = async () => {
    const PORT = process.env.PORT || 5001;
    const baseUrl = `http://localhost:${PORT}/api/auth`;
    console.log('--- Testing Registration ---');
    try {
        const response = await fetch(`${baseUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Teacher',
                email: `teacher_${Date.now()}@example.com`,
                password: 'password123',
                role: 'teacher'
            })
        });
        const data = await response.json();
        console.log('Registration status:', response.status);
        console.log('Registration response:', data);
    }
    catch (error) {
        console.error('Registration failed:', error.message);
    }
    console.log('\n--- Testing Login ---');
    try {
        const email = `student_${Date.now()}@example.com`;
        // Register
        await fetch(`${baseUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Student',
                email,
                password: 'studentpassword',
                role: 'student'
            })
        });
        // Login
        const response = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password: 'studentpassword'
            })
        });
        const data = await response.json();
        console.log('Login status:', response.status);
        console.log('Login response:', data);
        if (data.token) {
            console.log('Token starts with:', data.token.substring(0, 20) + '...');
        }
    }
    catch (error) {
        console.error('Login failed:', error.message);
    }
};
runTest();
export {};
