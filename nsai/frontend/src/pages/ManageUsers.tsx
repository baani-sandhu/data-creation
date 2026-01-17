import { useEffect, useState } from "react";
import { authService } from "../services/authService";
import { useAuth } from "../contexts/authContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TeamMember {
  _id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
}

export default function ManageTeam() {
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const res = await authService.getMyTeam();
      setTeam(res.data);
    } catch (err: any) {
      setError("Failed to load team members.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
          <p className="text-muted-foreground">
            {user?.role === "super" 
              ? "Manage the administrators linked to your account." 
              : "Manage the standard users linked to your account."}
          </p>
        </div>
        <Button onClick={() => window.location.href='/register'}>
          + Add New {user?.role === "super" ? "Admin" : "User"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active {user?.role === "super" ? "Admins" : "Users"}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Loading team data...</div>
          ) : error ? (
            <div className="py-10 text-center text-red-500">{error}</div>
          ) : team.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No accounts found. Create your first one to get started.
            </div>
          ) : (
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b bg-muted/50">
                  <tr className="border-b transition-colors">
                    <th className="h-12 px-4 text-left align-middle font-medium">Name</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Username</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Email</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Role</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {team.map((member) => (
                    <tr key={member._id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle font-medium">
                        {member.first_name} {member.last_name}
                      </td>
                      <td className="p-4 align-middle">{member.username}</td>
                      <td className="p-4 align-middle">{member.email}</td>
                      <td className="p-4 align-middle">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          member.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="p-4 align-middle text-right">
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}