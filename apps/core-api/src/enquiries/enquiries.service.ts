import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enquiry } from './enquiry.entity';

@Injectable()
export class EnquiriesService {
  constructor(
    @InjectRepository(Enquiry)
    private readonly repo: Repository<Enquiry>,
  ) {}

  async create(data: { name: string; email: string; phone?: string; businessType?: string; message?: string }) {
    const conditions: any[] = [{ email: data.email }];
    if (data.phone?.trim()) conditions.push({ phone: data.phone.trim() });

    const existing = await this.repo.findOne({ where: conditions });
    if (existing) {
      const field = existing.email === data.email ? 'email' : 'phone number';
      throw new ConflictException(`An enquiry with this ${field} already exists. We will get back to you shortly.`);
    }

    const enquiry = this.repo.create();
    enquiry.name = data.name;
    enquiry.email = data.email;
    enquiry.phone = data.phone?.trim() || null;
    enquiry.businessType = data.businessType || null;
    enquiry.message = data.message || null;
    return this.repo.save(enquiry);
  }

  async findAll(page = 1, perPage = 20, status?: string) {
    const qb = this.repo.createQueryBuilder('e').orderBy('e.created_at', 'DESC');
    if (status && status !== 'all') qb.where('e.status = :status', { status });
    const total = await qb.getCount();
    const rows = await qb.skip((page - 1) * perPage).take(perPage).getMany();
    return { rows, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  async updateStatus(id: string, status: string, adminNotes?: string) {
    await this.repo.update(id, { status, ...(adminNotes !== undefined ? { adminNotes } : {}) });
    return this.repo.findOneBy({ id });
  }
}
