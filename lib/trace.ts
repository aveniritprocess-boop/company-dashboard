export function trace(message: string) {
    console.log("[TRACE]", message);
    if (typeof window !== "undefined") {
        fetch('/api/debug-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "[TRACE] " + message, stack: "", componentStack: "" })
        }).catch(() => {});
    } else {
        // We can just fetch our own API from the server side too!
        fetch('http://localhost:3000/api/debug-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "[TRACE Server] " + message, stack: "", componentStack: "" })
        }).catch(() => {});
    }
}
