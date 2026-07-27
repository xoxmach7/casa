'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Grid3x3, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getApiUrl } from '@/lib/api-config';

interface Project {
  id: string;
  name: string;
  city: string;
  address: string;
  apartmentStats: {
    total: number;
    available: number;
    reserved: number;
    sold: number;
  };
}

export default function ChessboardSelectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Проверяем параметр projectId для автоматического перехода
  const projectIdParam = searchParams.get('projectId');

  useEffect(() => {
    // Если есть projectId, сразу переходим к шахматке этого проекта
    if (projectIdParam) {
      router.push(`/dashboard/projects/${projectIdParam}/apartments`);
      return;
    }
    fetchProjects();
  }, [projectIdParam]);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        getApiUrl('/projects'),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch projects');

      const data = await response.json();
      setProjects(data.projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-3xl font-bold">Шахматка квартир</h1>
        <p className="text-muted-foreground">
          Выберите жилой комплекс для просмотра шахматки
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Нет доступных проектов
              </p>
              <Button onClick={() => router.push('/dashboard/projects')}>
                Перейти к проектам
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/dashboard/projects/${project.id}/apartments`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {project.city}
                    </CardDescription>
                  </div>
                  <Grid3x3 className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Всего квартир:</span>
                    <span className="font-medium ml-2">{project.apartmentStats.total}</span>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-green-50">
                      Доступно: {project.apartmentStats.available}
                    </Badge>
                    <Badge variant="outline" className="bg-yellow-50">
                      Забронировано: {project.apartmentStats.reserved}
                    </Badge>
                    <Badge variant="outline" className="bg-gray-50">
                      Продано: {project.apartmentStats.sold}
                    </Badge>
                  </div>

                  <Button className="w-full mt-4" variant="outline">
                    <Grid3x3 className="mr-2 h-4 w-4" />
                    Открыть шахматку
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
