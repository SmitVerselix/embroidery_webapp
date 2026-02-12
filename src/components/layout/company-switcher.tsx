"use client";

import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import {
  Building2,
  ChevronsUpDown,
  Check,
  Settings,
  ArrowRightLeft,
} from "lucide-react";

export function CompanySwitcher() {
  const { currentCompany, companies, clearCurrentCompany } = useAuth();
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSwitchCompany = () => {
    setShowSwitchDialog(false);
    clearCurrentCompany();
  };

  if (!currentCompany) {
    return (
      <SidebarMenuButton size="lg" onClick={handleSwitchCompany}>
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Building2 className="size-4" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">Select Workspace</span>
          <span className="truncate text-xs text-muted-foreground">
            Click to choose
          </span>
        </div>
      </SidebarMenuButton>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                {getInitials(currentCompany.company.name)}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">
                {currentCompany.company.name}
              </span>
              <span className="truncate text-xs capitalize text-muted-foreground">
                {currentCompany.role.name}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Current Workspace
          </DropdownMenuLabel>
          <DropdownMenuItem className="gap-2 p-2">
            <Avatar className="h-6 w-6 rounded-sm">
              <AvatarFallback className="rounded-sm text-xs">
                {getInitials(currentCompany.company.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="truncate font-medium">{currentCompany.company.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                @{currentCompany.company.code}
              </p>
            </div>
            <Check className="h-4 w-4 text-primary" />
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setShowSwitchDialog(true)}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Switch Workspace
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Workspace Settings
            </DropdownMenuItem>
          </DropdownMenuGroup>

          {companies.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Other Workspaces ({companies.length - 1})
              </DropdownMenuLabel>
              {companies
                .filter((c) => c.company.id !== currentCompany.company.id)
                .slice(0, 3)
                .map((company) => (
                  <DropdownMenuItem
                    key={company.company.id}
                    className="gap-2 p-2 cursor-pointer"
                    onClick={() => setShowSwitchDialog(true)}
                  >
                    <Avatar className="h-6 w-6 rounded-sm">
                      <AvatarFallback className="rounded-sm text-xs">
                        {getInitials(company.company.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{company.company.name}</span>
                  </DropdownMenuItem>
                ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Switch Workspace Confirmation Dialog */}
      <Dialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch Workspace</DialogTitle>
            <DialogDescription>
              You will be redirected to the workspace selection page. Any unsaved
              changes may be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSwitchDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSwitchCompany}>Switch Workspace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}