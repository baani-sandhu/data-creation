import React, { useState } from "react";
import { useAuth } from "../contexts/authContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export const RegistrationForm = () => {
  const { user, register } = useAuth(); // Use the context function
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Determine initial role based on who is logged in
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    first_name: "",
    last_name: "",
    role: user?.role === "super" ? "admin" : "user", 
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await register(formData);
      setMessage({ 
        type: "success", 
        text: `Successfully created ${formData.role}: ${formData.username}` 
      });

      setFormData({ 
        email: "", username: "", password: "", first_name: "", last_name: "", 
        role: user?.role === "super" ? "admin" : "user" 
      });
    } catch (err: any) {
      setMessage({ 
        type: "error", 
        text: err.response?.data?.detail || "Registration failed" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Internal Registration</h2>
        <p className="text-sm text-gray-500">
          Logged in as: <span className="font-semibold uppercase">{user?.role}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="role">Select Account Role to Create</Label>
          <select 
            id="role"
            className="w-full border rounded-md p-2 mt-1 bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            value={formData.role}
            // Disable if Admin (Admins can ONLY create users)
            disabled={user?.role !== 'super'}
            onChange={(e) => setFormData({...formData, role: e.target.value})}
            required
          >
            {user?.role === 'super' && <option value="admin">Administrator</option>}
            {/* <option value="user">Standard User</option> */}
          </select>
          {user?.role === 'admin' && (
            <p className="text-xs text-gray-400 mt-1">Admins can only create standard users.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>First Name</Label>
            <Input 
              placeholder="Joe" 
              value={formData.first_name} 
              onChange={(e) => setFormData({...formData, first_name: e.target.value})} 
              required 
            />
          </div>
          <div className="space-y-1">
            <Label>Last Name</Label>
            <Input 
              placeholder="Smith" 
              value={formData.last_name} 
              onChange={(e) => setFormData({...formData, last_name: e.target.value})} 
              required 
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Username</Label>
          <Input 
            placeholder="name_admin" 
            value={formData.username} 
            onChange={(e) => setFormData({...formData, username: e.target.value})} 
            required 
          />
        </div>

        <div className="space-y-1">
          <Label>Email Address</Label>
          <Input 
            type="email" 
            placeholder="name@example.com" 
            value={formData.email} 
            onChange={(e) => setFormData({...formData, email: e.target.value})} 
            required 
          />
        </div>

        <div className="space-y-1">
          <Label>Temporary Password</Label>
          <Input 
            type="password" 
            placeholder="••••••••" 
            value={formData.password} 
            onChange={(e) => setFormData({...formData, password: e.target.value})} 
            required 
          />
        </div>

        <Button type="submit" className="w-full mt-4" disabled={loading}>
          Register {user?.role === "super" ? "Admin " : "User"}
          {loading ? "Processing..." : `Create ${formData.role}`}
        </Button>

        {message.text && (
          <div className={`p-3 rounded-md text-sm font-medium ${
            message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
};