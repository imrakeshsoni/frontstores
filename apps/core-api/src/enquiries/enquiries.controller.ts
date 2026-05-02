import { Body, Controller, Get, Param, Patch, Post, Query, ForbiddenException, HttpCode, HttpStatus } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser, successResponse } from '@frontstores/common';
import { EnquiriesService } from './enquiries.service';

class CreateEnquiryDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  message?: string;
}

class UpdateEnquiryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}

@Controller('enquiries')
export class EnquiriesController {
  constructor(private readonly service: EnquiriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateEnquiryDto) {
    const enquiry = await this.service.create(dto);
    return successResponse(enquiry);
  }

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('perPage') perPage = '20',
    @Query('status') status = 'all',
  ) {
    if (!user?.isPlatformAdmin) throw new ForbiddenException('Platform admin access required');
    return successResponse(await this.service.findAll(Number(page), Number(perPage), status));
  }

  @Patch(':id')
  async updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateEnquiryDto,
  ) {
    if (!user?.isPlatformAdmin) throw new ForbiddenException('Platform admin access required');
    const updated = await this.service.updateStatus(id, dto.status!, dto.adminNotes);
    return successResponse(updated);
  }
}
