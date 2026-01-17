"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { projectService } from "@/services/projectService";
import type { ProjectResponse, ProjectUpdate } from "@/types/projectType";

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  base_model: z.enum(["llama-3", "gpt-4", "default-model"]),
  dataset_link: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  configuration: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

interface ProjectEditDialogProps {
  project: ProjectResponse;
  onSuccess?: () => void;
  // If you want to use it outside the DropdownMenu, you can pass a custom trigger
  trigger?: React.ReactNode;
}

const ProjectEditDialog = ({ project, onSuccess, trigger }: ProjectEditDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project.name,
      base_model: (project.base_model as any) || "default-model",
      dataset_link: project.dataset_url || "",
      configuration: project.configuration 
        ? JSON.stringify(project.configuration, null, 2) 
        : "",
    },
  });

  // Ensure form resets if the project prop changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: project.name,
        base_model: (project.base_model as any) || "default-model",
        dataset_link: project.dataset_url || "",
        configuration: project.configuration 
          ? JSON.stringify(project.configuration, null, 2) 
          : "",
      });
    }
  }, [project, open, form]);

  const onSubmit = async (data: ProjectFormValues) => {
    setIsLoading(true);
    try {
      let parsedConfiguration: Record<string, any> | undefined;
      if (data.configuration?.trim()) {
        try {
          parsedConfiguration = JSON.parse(data.configuration);
        } catch {
          parsedConfiguration = { description: data.configuration };
        }
      }

      const payload: ProjectUpdate = {
        name: data.name,
        base_model: data.base_model,
        dataset_link: data.dataset_link || undefined,
        configuration: parsedConfiguration,
      };

      await projectService.update(project._id, payload);
      
      toast.success("Project updated successfully!");
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || "Failed to update project";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update the details for "{project.name}".
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="base_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Model</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="llama-3">Llama 3</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="default-model">Default Model</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dataset_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dataset Link</FormLabel>
                  <FormControl>
                    <Input type="url" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="configuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Configuration (JSON)</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-[100px] font-mono text-xs" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectEditDialog;