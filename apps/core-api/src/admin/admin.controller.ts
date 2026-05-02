import {
  Body, Controller, Delete, ForbiddenException, Get,
  Param, Patch, Post, Put, Query,
} from '@nestjs/common';
import { CurrentUser, successResponse } from '@frontstores/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  async overview(@CurrentUser() user: any) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.overview());
  }

  @Get('apps')
  async apps(@CurrentUser() user: any) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.apps());
  }

  @Get('tenants')
  async tenants(@CurrentUser() user: any, @Query('page') page = '1', @Query('perPage') perPage = '12', @Query('search') search = '', @Query('status') status = '') {
    this.assertAdmin(user);
    return successResponse(await this.adminService.tenants({ page: Number(page), perPage: Number(perPage), search, status }));
  }

  @Post('tenants')
  async createTenant(@CurrentUser() user: any, @Body() body: any) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.createTenant(body));
  }

  @Get('tenants/:tenantId')
  async tenantDetail(@CurrentUser() user: any, @Param('tenantId') tenantId: string) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.tenantDetail(tenantId));
  }

  @Patch('tenants/:tenantId/status')
  async updateTenantStatusPatch(@CurrentUser() user: any, @Param('tenantId') tenantId: string, @Body('status') status: string) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.updateTenantStatus(tenantId, status));
  }

  @Put('tenants/:tenantId/status')
  async updateTenantStatus(@CurrentUser() user: any, @Param('tenantId') tenantId: string, @Body('status') status: string) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.updateTenantStatus(tenantId, status));
  }

  @Put('tenants/:tenantId/plan')
  async updateTenantPlan(@CurrentUser() user: any, @Param('tenantId') tenantId: string, @Body('plan') plan: string) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.updateTenantPlan(tenantId, plan));
  }

  @Get('tenants/:tenantId/flags')
  async getTenantFlags(@CurrentUser() user: any, @Param('tenantId') tenantId: string) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.getTenantFlags(tenantId));
  }

  @Put('tenants/:tenantId/flags')
  async updateTenantFlags(@CurrentUser() user: any, @Param('tenantId') tenantId: string, @Body('flags') flags: Record<string, boolean>) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.updateTenantFlags(tenantId, flags));
  }

  @Get('tenants/:tenantId/notes')
  async getTenantNotes(@CurrentUser() user: any, @Param('tenantId') tenantId: string) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.getTenantNotes(tenantId));
  }

  @Post('tenants/:tenantId/notes')
  async addTenantNote(@CurrentUser() user: any, @Param('tenantId') tenantId: string, @Body('content') content: string) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.addTenantNote(tenantId, content, user.email ?? 'admin'));
  }

  @Post('tenants/:tenantId/users')
  async addTenantUser(@CurrentUser() user: any, @Param('tenantId') tenantId: string, @Body() body: { email: string; name: string; phone?: string }) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.addTenantUser(tenantId, body));
  }

  @Delete('notes/:noteId')
  async deleteTenantNote(@CurrentUser() user: any, @Param('noteId') noteId: string) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.deleteTenantNote(noteId));
  }

  @Get('announcements')
  async getAnnouncements(@CurrentUser() user: any) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.getAnnouncements());
  }

  @Post('announcements')
  async createAnnouncement(@CurrentUser() user: any, @Body() body: any) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.createAnnouncement(body));
  }

  @Get('stats/mrr')
  async statsMrr(@CurrentUser() user: any) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.statsMrr());
  }

  @Get('stats/funnel')
  async statsFunnel(@CurrentUser() user: any) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.statsFunnel());
  }

  @Get('audit')
  async audit(@CurrentUser() user: any, @Query('page') page = '1', @Query('perPage') perPage = '25', @Query('action') action = '', @Query('search') search = '') {
    this.assertAdmin(user);
    return successResponse(await this.adminService.audit({ page: Number(page), perPage: Number(perPage), action, search }));
  }

  @Get('health')
  async health(@CurrentUser() user: any) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.health());
  }

  @Get('gcp-metrics')
  async gcpMetrics(@CurrentUser() user: any) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.gcpMetrics());
  }

  @Get('users')
  async users(@CurrentUser() user: any, @Query('page') page = '1', @Query('perPage') perPage = '15', @Query('search') search = '', @Query('access') access = 'all') {
    this.assertAdmin(user);
    return successResponse(await this.adminService.users({ page: Number(page), perPage: Number(perPage), search, access }));
  }

  @Patch('users/:userId/access')
  async updateUserAccessPatch(@CurrentUser() user: any, @Param('userId') userId: string, @Body() body: { isActive?: boolean; isPlatformAdmin?: boolean }) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.updateUserAccess(userId, body));
  }

  @Put('users/:userId/access')
  async updateUserAccessPut(@CurrentUser() user: any, @Param('userId') userId: string, @Body() body: { isActive?: boolean; is_active?: boolean; isPlatformAdmin?: boolean }) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.updateUserAccess(userId, { isActive: body.isActive ?? body.is_active, isPlatformAdmin: body.isPlatformAdmin }));
  }

  @Post('users/:userId/reset-password')
  async resetUserPassword(@CurrentUser() user: any, @Param('userId') userId: string, @Body('password') password: string) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.resetUserPassword(userId, password));
  }

  @Post('impersonate/:userId')
  async impersonate(@CurrentUser() user: any, @Param('userId') userId: string) {
    this.assertAdmin(user);
    return successResponse(await this.adminService.impersonate(userId, user.email));
  }

  @Get('tables')
  async tables(@CurrentUser() user: any) {
    this.assertAdmin(user);
    return successResponse(this.adminService.tables());
  }

  @Get('table')
  async table(@CurrentUser() user: any, @Query('name') name: string, @Query('page') page = '1', @Query('perPage') perPage = '25', @Query('search') search = '') {
    this.assertAdmin(user);
    return successResponse(await this.adminService.table(name, Number(page), Number(perPage), search));
  }

  private assertAdmin(user: any) {
    if (user?.isPlatformAdmin !== true) throw new ForbiddenException('Platform admin access required');
  }
}
