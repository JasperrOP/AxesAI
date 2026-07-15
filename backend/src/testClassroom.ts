const runTest = async () => {
  const PORT = process.env.PORT || 5001;
  const baseUrl = `http://localhost:${PORT}/api`;

  console.log('--- Classroom Integration Test ---');
  try {
    const teacherEmail = `teacher_${Date.now()}@example.com`;
    const regTeacherRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Teacher',
        email: teacherEmail,
        password: 'password123',
        role: 'teacher'
      })
    });

    const loginTeacherRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: teacherEmail,
        password: 'password123'
      })
    });
    const loginTeacherData = await loginTeacherRes.json() as any;
    const teacherToken = loginTeacherData.token;

    const createClassRes = await fetch(`${baseUrl}/classrooms`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({ name: 'Science Class 101' })
    });
    const classData = await createClassRes.json() as any;
    console.log('Classroom creation status:', createClassRes.status);
    console.log('Classroom details:', classData.classroom ? 'Success (Join Code: ' + classData.classroom.joinCode + ')' : classData);

    const joinCode = classData.classroom.joinCode;

    const studentEmail = `student_${Date.now()}@example.com`;
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Student',
        email: studentEmail,
        password: 'password123',
        role: 'student'
      })
    });

    const loginStudentRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: studentEmail,
        password: 'password123'
      })
    });
    const loginStudentData = await loginStudentRes.json() as any;
    const studentToken = loginStudentData.token;

    const joinRes = await fetch(`${baseUrl}/classrooms/join`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ joinCode })
    });
    const joinData = await joinRes.json() as any;
    console.log('Student Join Status:', joinRes.status);
    console.log('Student Join Response:', joinData.message);

    const getTeacherClassesRes = await fetch(`${baseUrl}/classrooms`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${teacherToken}` }
    });
    const teacherClasses = await getTeacherClassesRes.json() as any;
    console.log('Teacher Classrooms count:', teacherClasses.classrooms.length);
    console.log('First Classroom joined students count:', teacherClasses.classrooms[0].studentIds.length);

  } catch (error: any) {
    console.error('Integration test failed:', error.message);
  }
};

runTest();
