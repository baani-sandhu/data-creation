"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Pencil,
  Trash,
  Play,
  Link as LinkIcon,
  Calendar,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { projectService } from "@/services/projectService";
import { toast } from "sonner";
import type { ProjectCardData } from "@/types/projectType";

interface ProjectCardProps {
  project: ProjectCardData;
  onEdit: (project: ProjectCardData) => void;
  onDelete: (project: ProjectCardData) => void;
  onTrainingStart?: (projectId: string) => void;
}

const ProjectCard = ({
  project,
  onEdit,
  onDelete,
  onTrainingStart,
}: ProjectCardProps) => {
  const [isTrainingLoading, setIsTrainingLoading] = useState(false);

  const createdDate = new Date(project.created_at).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete "${project.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await projectService.delete(project._id);
      toast.success("Project deleted successfully");
      onDelete(project);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "Failed to delete project";
      toast.error(errorMessage);
    }
  };

  const handleStartTraining = async () => {
    setIsTrainingLoading(true);
    try {
      if (onTrainingStart) {
        await onTrainingStart(project._id);
      } else {
        // Placeholder for training service integration
        toast.info("Training service integration coming soon");
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "Failed to start training";
      toast.error(errorMessage);
    } finally {
      setIsTrainingLoading(false);
    }
  };

  // Format metrics display - prioritize Loss, Accuracy, F1 Score if available
  const getMetricValue = (key: string) => {
    if (!project.metrics) return null;
    const lowerKey = key.toLowerCase();
    for (const [metricKey, value] of Object.entries(project.metrics)) {
      if (metricKey.toLowerCase() === lowerKey) {
        return value;
      }
    }
    return null;
  };

  const formatMetricValue = (
    value: number | string,
    metricKey: string
  ): string => {
    if (typeof value === "number") {
      // Format accuracy as percentage (0-1 range as percentage)
      if (metricKey.toLowerCase() === "accuracy" && value <= 1 && value >= 0) {
        return `${(value * 100).toFixed(1)}%`;
      }
      // Format other decimal numbers (Loss, F1 Score, etc.)
      if (value < 1) {
        return value.toFixed(3);
      }
      // Format whole numbers or larger decimals
      return value.toString();
    }
    return String(value);
  };

  const loss = getMetricValue("loss");
  const accuracy = getMetricValue("accuracy");
  const f1Score = getMetricValue("f1_score") || getMetricValue("f1score");

  return (
    <Card className="flex flex-col transition-shadow hover:shadow-lg w-full max-w-md">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">
              {project.name}
            </h3>
            <Badge
              variant="secondary"
              className="text-xs font-normal shrink-0 bg-muted text-muted-foreground"
            >
              {project.base_model}
            </Badge>
          </div>

          {/* Three-dot menu - always visible */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onEdit(project)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Project
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDelete}
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="space-y-4 flex-1">
        {/* Created Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>Created: {createdDate}</span>
        </div>

        {/* Dataset URL */}
        {project.dataset_url && (
          <a
            href={project.dataset_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline group/link"
          >
            <LinkIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{project.dataset_url}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
          </a>
        )}

        {/* Metrics Section */}
        {(loss !== null || accuracy !== null || f1Score !== null) && (
          <div className="space-y-2 pt-2">
            <h4 className="text-sm font-medium text-foreground">Metrics</h4>
            <div className="space-y-1.5">
              {loss !== null && (
                <div className="flex items-center justify-between text-sm py-1">
                  <span className="text-muted-foreground">Loss:</span>
                  <span className="font-medium text-foreground">
                    {formatMetricValue(loss, "loss")}
                  </span>
                </div>
              )}
              {accuracy !== null && (
                <div className="flex items-center justify-between text-sm py-1">
                  <span className="text-muted-foreground">Accuracy:</span>
                  <span className="font-medium text-foreground">
                    {formatMetricValue(accuracy, "accuracy")}
                  </span>
                </div>
              )}
              {f1Score !== null && (
                <div className="flex items-center justify-between text-sm py-1">
                  <span className="text-muted-foreground">F1 Score:</span>
                  <span className="font-medium text-foreground">
                    {formatMetricValue(f1Score, "f1_score")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Footer */}
      <CardFooter className="pt-4">
        <Button
          className="w-full gap-2 h-11 text-base font-medium"
          onClick={handleStartTraining}
          disabled={isTrainingLoading}
        >
          {isTrainingLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Start Training
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProjectCard;
