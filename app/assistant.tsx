// chatbot-front/app/assistant.tsx
"use client";

import Image from "next/image"; // تأكد من استيراد مكون الصورة
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { MyRuntimeProvider } from "@/components/MyRuntimeProvider";

export const Assistant = () => {
  return (
    <MyRuntimeProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  {/*
                    تم التعديل: إضافة أيقونة علم قطر بجانب النص في BreadcrumbPage
                    تأكد من أن ملف flag-qatar.png موجود في مجلد public/
                  */}
                  <BreadcrumbPage className="flex items-center gap-2">
                    <Image 
                      src="/flag-qatar.png" 
                      alt="علم قطر" 
                      width={20} 
                      height={13} // ارتفاع مناسب للعلم ليتناسب مع النص
                      className="rounded-sm" // لجعل حواف العلم ناعمة قليلاً
                    />
                    بن غيث للمحاماة والأستشارات القانونية
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <Thread />
        </SidebarInset>
      </SidebarProvider>
    </MyRuntimeProvider>
  );
};