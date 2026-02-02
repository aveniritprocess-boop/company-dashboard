"use client";

import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthProvider";
import { Trash2, Plus, Check, Circle } from "lucide-react";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: any;
}

export function TodoList() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setError(null);

    const q = query(
      collection(db, "users", user.uid, "todos"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const todosData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Todo[];
        setTodos(todosData);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching todos:", err);
        setError("Failed to load todos. You might be offline or missing permissions.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim() || !user) return;
    setError(null);

    try {
      await addDoc(collection(db, "users", user.uid, "todos"), {
        text: newTodo,
        completed: false,
        createdAt: serverTimestamp(),
      });
      setNewTodo("");
    } catch (error: any) {
      console.error("Error adding todo: ", error);
      setError("Failed to add todo. Please try again.");
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "todos", id), {
        completed: !completed,
      });
    } catch (error: any) {
      console.error("Error toggling todo: ", error);
      setError("Failed to update todo.");
    }
  };

  const deleteTodo = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "todos", id));
    } catch (error: any) {
      console.error("Error deleting todo: ", error);
      setError("Failed to delete todo.");
    }
  };

  if (loading) {
     return <div className="text-center py-4 text-gray-500">Loading todos...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-200">
          {error}
        </div>
      )}
      <form onSubmit={addTodo} className="mb-6 relative">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add a new todo..."
          className="w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-3 pl-4 pr-12 shadow-sm focus:border-primary focus:ring-primary dark:text-white"
        />
        <button
          type="submit"
          disabled={!newTodo.trim()}
          className="absolute right-2 top-2 rounded-md bg-primary p-1 text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          <Plus className="h-5 w-5" />
        </button>
      </form>

      <div className="space-y-3">
        {todos.length === 0 && !error && (
           <p className="text-center text-gray-500 py-10">No todos yet. Add one above!</p>
        )}
        {todos.map((todo) => (
          <div
            key={todo.id}
            className="group flex items-center justify-between rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 p-3 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleTodo(todo.id, todo.completed)}
                className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                  todo.completed
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-gray-300 dark:border-gray-600 hover:border-green-500"
                }`}
              >
                {todo.completed && <Check className="h-4 w-4" />}
              </button>
              <span
                className={`${
                  todo.completed
                    ? "text-gray-400 line-through dark:text-gray-500"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {todo.text}
              </span>
            </div>
            <button
              onClick={() => deleteTodo(todo.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
