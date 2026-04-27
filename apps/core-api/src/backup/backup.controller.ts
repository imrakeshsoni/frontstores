import {
  Controller, Get, Post, Res,
  UseInterceptors, UploadedFile, HttpCode, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentTenant, TenantContext, successResponse } from '@shoposphere/common';
import { BackupService } from './backup.service';

@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('export')
  async exportBackup(
    @CurrentTenant() ctx: TenantContext,
    @Res() res: Response,
  ) {
    await this.backupService.exportZip(ctx.tenantId, ctx.shopId ?? '', res);
  }

  @Post('restore')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async restoreBackup(
    @CurrentTenant() ctx: TenantContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const result = await this.backupService.restoreZip(ctx.tenantId, ctx.shopId ?? '', file.buffer);
    return successResponse(result);
  }
}
