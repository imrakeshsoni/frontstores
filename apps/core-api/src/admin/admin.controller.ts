import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, successResponse } from '@shoposphere/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  async overview(@CurrentUser() user: any) {
    this.assertPlatformAdmin(user);
    return successResponse(await this.adminService.overview());
  }

  @Get('tenants')
  async tenants(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('perPage') perPage = '12',
    @Query('search') search = '',
    @Query('status') status = '',
  ) {
    this.assertPlatformAdmin(user);
    return successResponse(
      await this.adminService.tenants({
        page: Number(page),
        perPage: Number(perPage),
        search,
        status,
      }),
    );
  }

  @Get('tenants/:tenantId')
  async tenantDetail(@CurrentUser() user: any, @Param('tenantId') tenantId: string) {
    this.assertPlatformAdmin(user);
    return successResponse(await this.adminService.tenantDetail(tenantId));
  }

  @Patch('tenants/:tenantId/status')
  async updateTenantStatus(
    @CurrentUser() user: any,
    @Param('tenantId') tenantId: string,
    @Body('status') status: string,
  ) {
    this.assertPlatformAdmin(user);
    return successResponse(await this.adminService.updateTenantStatus(tenantId, status));
  }

  @Get('users')
  async users(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('perPage') perPage = '15',
    @Query('search') search = '',
    @Query('access') access = 'all',
  ) {
    this.assertPlatformAdmin(user);
    return successResponse(
      await this.adminService.users({
        page: Number(page),
        perPage: Number(perPage),
        search,
        access,
      }),
    );
  }

  @Patch('users/:userId/access')
  async updateUserAccess(
    @CurrentUser() user: any,
    @Param('userId') userId: string,
    @Body() body: { isActive?: boolean; isPlatformAdmin?: boolean },
  ) {
    this.assertPlatformAdmin(user);
    return successResponse(await this.adminService.updateUserAccess(userId, body));
  }

  @Post('users/:userId/reset-password')
  async resetUserPassword(
    @CurrentUser() user: any,
    @Param('userId') userId: string,
    @Body('password') password: string,
  ) {
    this.assertPlatformAdmin(user);
    return successResponse(await this.adminService.resetUserPassword(userId, password));
  }

  @Get('tables')
  async tables(@CurrentUser() user: any) {
    this.assertPlatformAdmin(user);
    return successResponse(this.adminService.tables());
  }

  @Get('table')
  async table(
    @CurrentUser() user: any,
    @Query('name') name: string,
    @Query('page') page = '1',
    @Query('perPage') perPage = '25',
    @Query('search') search = '',
  ) {
    this.assertPlatformAdmin(user);
    return successResponse(
      await this.adminService.table(name, Number(page), Number(perPage), search),
    );
  }

  private assertPlatformAdmin(user: any) {
    if (user?.isPlatformAdmin !== true) {
      throw new ForbiddenException('Platform admin access required');
    }
  }
}
