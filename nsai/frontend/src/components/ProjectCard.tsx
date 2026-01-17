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
import type { ProjectResponse } from "@/types/projectType";
import ProjectEditDialog from "./ProjectEditDialog";

interface ProjectCardProps {
  project: ProjectResponse;
  onDelete: (projectId: string) => void;
  onTrainingStart?: (projectId: string) => void;
  onEditSuccess: () => void;
}

const ProjectCard = ({
  project,
  onDelete,
  onTrainingStart,
  onEditSuccess,
}: ProjectCardProps) => {
  const [isTrainingLoading, setIsTrainingLoading] = useState(false);

  const createdDate = new Date(project.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleDeleteClick = () => {
    if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
      onDelete(project._id);
    }
  };

  const handleStartTraining = async () => {
    if (!onTrainingStart) return;
    setIsTrainingLoading(true);
    try {
      await onTrainingStart(project._id);
    } finally {
      setIsTrainingLoading(false);
    }
  };

  const getMetricValue = (key: string) => {
    if (!project.metrics) return null;
    const found = Object.entries(project.metrics).find(
      ([k]) => k.toLowerCase() === key.toLowerCase()
    );
    return found ? found[1] : null;
  };

  const formatMetricValue = (value: number | string, key: string): string => {
    if (typeof value === "number") {
      if (key.toLowerCase() === "accuracy" && value <= 1) {
        return `${(value * 100).toFixed(1)}%`;
      }
      return value < 1 ? value.toFixed(3) : value.toString();
    }
    return String(value);
  };

  const loss = getMetricValue("loss");
  const accuracy = getMetricValue("accuracy");

  return (
    <Card className="flex flex-col transition-shadow hover:shadow-lg w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">
              {project.name}
            </h3>
            <Badge variant="secondary" className="text-xs font-normal shrink-0">
              {project.base_model}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              
              {/* --- ProjectEditDialog Integration --- */}
              <ProjectEditDialog
                project={project}
                onSuccess={onEditSuccess}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                }
              />
              
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDeleteClick}
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>Created: {createdDate}</span>
        </div>

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

        {(loss !== null || accuracy !== null) && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between text-sm">
              {loss !== null && (
                <span className="text-muted-foreground">
                  Loss: <b className="text-foreground">{formatMetricValue(loss, "loss")}</b>
                </span>
              )}
              {accuracy !== null && (
                <span className="text-muted-foreground">
                  Acc: <b className="text-foreground">{formatMetricValue(accuracy, "accuracy")}</b>
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-4">
        <Button
          className="w-full gap-2"
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