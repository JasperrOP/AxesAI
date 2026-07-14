import { Router } from 'express';
import { createAssignment, getAssignment } from '../controllers/assignmentController.js';

const router = Router();

// POST route to create a new assignment
router.post('/create', createAssignment);
// Add the GET route
router.get('/:id', getAssignment); 

export default router;