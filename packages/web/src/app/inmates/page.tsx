'use client';

import { Search, Plus } from 'lucide-react';
import { useState } from 'react';

import { AddInmateDialog } from '@/components/inmate-management/add-inmate-dialog';
import { Sidebar } from '@/components/layout/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function InmatesPage(): JSX.Element {
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const handleAddInmate = async (inmateData: {
    inmateNumber: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    admissionDate?: string;
    status?: string;
  }) => {
    try {
      // Note: This endpoint may need to be created in the API
      // For now, we'll use a placeholder endpoint
      const response = await fetch(`${API_URL}/inmates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inmateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add inmate');
      }

      // Refresh the page or update the list
      window.location.reload();
    } catch (error) {
      console.error('Error adding inmate:', error);
      throw error;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-auto p-6">
        <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inmates</h1>
          <p className="text-muted-foreground">
            Manage inmate profiles and device assignments
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Inmate
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter inmates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by inmate number, name..."
                className="pl-10"
              />
            </div>
            <Button variant="outline">Filter</Button>
          </div>
        </CardContent>
      </Card>

      {/* Inmate List */}
      <Card>
        <CardHeader>
          <CardTitle>Inmate List</CardTitle>
          <CardDescription>
            All inmates in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No inmates found. Inmates will appear here once added to the system.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddInmateDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddInmate}
      />
        </div>
      </div>
    </div>
  );
}
