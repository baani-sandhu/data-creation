import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

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
  FormDescription,
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
import type { ProjectCreate } from "@/types/projectType";

// Zod schema for form validation
const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  base_model: z.enum(["llama-3", "gpt-4", "default-model"]).optional(),
  dataset_link: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  configuration: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

interface ProjectCreateDialogProps {
  onSuccess?: () => void;
}

const ProjectCreateDialog = ({ onSuccess }: ProjectCreateDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      base_model: "default-model",
      dataset_link: "",
      configuration: "",
    },
  });

  const onSubmit = async (data: ProjectFormValues) => {
    setIsLoading(true);
    try {
      // Parse configuration if provided
      let parsedConfiguration: Record<string, any> | undefined;
      if (data.configuration && data.configuration.trim()) {
        try {
          parsedConfiguration = JSON.parse(data.configuration);
        } catch {
          // If not valid JSON, treat as plain text
          parsedConfiguration = { description: data.configuration };
        }
      }

      // Prepare the payload according to ProjectCreate interface
      const payload: ProjectCreate = {
        name: data.name,
        base_model: data.base_model,
        dataset_link: data.dataset_link || undefined,
        configuration: parsedConfiguration,
      };

      await projectService.create(payload);
      
      toast.success("Project created successfully!");
      form.reset();
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "Failed to create project";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Create a new project to start training your model. Fill in the
            details below.
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
                    <Input placeholder="Enter project name" {...field} />
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
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a base model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="llama-3">Llama 3</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="default-model">Default Model</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose the base model for your project
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dataset_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dataset Link (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://example.com/dataset"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    URL to your dataset (optional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="configuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Configuration (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Enter JSON configuration or descriptive text, e.g., {"epochs": 10, "batch_size": 32}'
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    JSON configuration or descriptive text
                  </FormDescription>
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
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectCreateDialog;
