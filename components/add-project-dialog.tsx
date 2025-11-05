'use client';

import { useState } from 'react';
import { useUser, useSession } from '@clerk/nextjs';
import { FolderOpen, Sparkles, Smartphone, ArrowLeft } from 'lucide-react';
import { createClerkSupabaseClient } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FlowStep = 'select' | 'import' | 'create-web' | 'create-mobile';

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectAdded: () => void;
}

export function AddProjectDialog({ open, onOpenChange, onProjectAdded }: AddProjectDialogProps) {
  const { user } = useUser();
  const { session } = useSession();
  const [step, setStep] = useState<FlowStep>('select');
  const [loading, setLoading] = useState(false);
  const [projectPath, setProjectPath] = useState('');
  const [projectName, setProjectName] = useState('');

  const handleImportProject = async () => {
    try {
      // Use File System Access API to select folder
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker();
      const path = dirHandle.name; // This gets the folder name

      setProjectPath(path);
      setProjectName(dirHandle.name);
      setStep('import');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error selecting folder:', err);
        alert('Failed to select folder. Make sure your browser supports folder selection.');
      }
    }
  };

  const handleSaveProject = async (projectType: 'import' | 'web' | 'mobile') => {
    if (!user || !session) return;
    if (!projectName.trim() || !projectPath.trim()) {
      alert('Please provide a project name and path');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClerkSupabaseClient(() => session.getToken());

      const { error } = await supabase
        .from('projects')
        .insert({
          clerk_user_id: user.id,
          project_name: projectName.trim(),
          project_path: projectPath.trim(),
          project_type: projectType,
        });

      if (error) throw error;

      // Reset state and close dialog
      setStep('select');
      setProjectPath('');
      setProjectName('');
      onOpenChange(false);
      onProjectAdded();
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('select');
    setProjectPath('');
    setProjectName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' && 'Add Project'}
            {step === 'import' && 'Import Existing Project'}
            {step === 'create-web' && 'Create Web App'}
            {step === 'create-mobile' && 'Create Mobile App'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Choose how you want to add a project'}
            {step === 'import' && 'Configure your imported project'}
            {step === 'create-web' && 'Set up a new web application'}
            {step === 'create-mobile' && 'Set up a new mobile application'}
          </DialogDescription>
        </DialogHeader>

        {/* Selection Step */}
        {step === 'select' && (
          <div className="grid gap-4 py-4">
            <Card
              className="cursor-pointer hover:border-teal-600 transition-colors"
              onClick={handleImportProject}
            >
              <CardContent className="flex items-start gap-4 pt-6">
                <div className="rounded-lg bg-teal-100 dark:bg-teal-900 p-3">
                  <FolderOpen className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Import Existing Project</h3>
                  <p className="text-sm text-muted-foreground">
                    Select a folder from your computer to work with
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-teal-600 transition-colors"
              onClick={() => setStep('create-web')}
            >
              <CardContent className="flex items-start gap-4 pt-6">
                <div className="rounded-lg bg-purple-100 dark:bg-purple-900 p-3">
                  <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Create New Project</h3>
                  <p className="text-sm text-muted-foreground">
                    Start fresh with AI-powered project scaffolding
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Import Step */}
        {step === 'import' && (
          <div className="space-y-4 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mb-2"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Awesome Project"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-path">Project Path</Label>
              <div className="flex gap-2">
                <Input
                  id="project-path"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="/path/to/project"
                  className="flex-1"
                />
                <Button onClick={handleImportProject} variant="outline">
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Click the folder icon to browse for a project folder
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleSaveProject('import')}
                disabled={loading || !projectName.trim() || !projectPath.trim()}
              >
                {loading ? 'Importing...' : 'Import Project'}
              </Button>
            </div>
          </div>
        )}

        {/* Create Web App Step */}
        {step === 'create-web' && (
          <div className="space-y-4 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mb-2"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div className="space-y-2">
              <Label htmlFor="web-project-name">Project Name</Label>
              <Input
                id="web-project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="my-web-app"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="web-project-path">Project Location</Label>
              <div className="flex gap-2">
                <Input
                  id="web-project-path"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="/path/to/create/project"
                  className="flex-1"
                />
                <Button onClick={handleImportProject} variant="outline">
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose where to create your new project
              </p>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm font-medium mb-2">Project will include:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Next.js 15 with App Router</li>
                <li>TypeScript configuration</li>
                <li>Tailwind CSS styling</li>
                <li>ESLint and Prettier setup</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleSaveProject('web')}
                disabled={loading || !projectName.trim() || !projectPath.trim()}
              >
                {loading ? 'Creating...' : 'Create Web App'}
              </Button>
            </div>
          </div>
        )}

        {/* Create Mobile App Step - Coming Soon */}
        {step === 'create-mobile' && (
          <div className="space-y-4 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mb-2"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Smartphone className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">Mobile App Creation Coming Soon</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                We're working on adding React Native and Flutter project templates. Stay tuned!
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
