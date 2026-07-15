'use client'; // Required in Next.js App Router for anything using hooks (useEffect, useState)

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

export default function LoadingScreen({ assignmentId }: { assignmentId: string }) {
    const router = useRouter();
    const [status, setStatus] = useState("AI is crafting your paper...");

    useEffect(() => {
        // Connect to your backend
        const socket = io('http://localhost:5001');

        // Listen for THIS specific assignment to finish
        socket.on(`assignment-complete-${assignmentId}`, (response) => {
            if (response.status === 'success') {
                setStatus("Paper ready! Redirecting...");
                
                setTimeout(() => {
                    router.push(`/assignment/${assignmentId}`); // Redirects to the final paper
                }, 1000);
            } else {
                setStatus("Generation failed. Please try again.");
            }
        });

        // Cleanup
        return () => {
            socket.off(`assignment-complete-${assignmentId}`);
            socket.disconnect();
        };
    }, [assignmentId, router]);

    return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg font-semibold">{status}</p>
        </div>
    );
}