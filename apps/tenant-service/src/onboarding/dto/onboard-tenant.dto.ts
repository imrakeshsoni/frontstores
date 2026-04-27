import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsIn,
  Matches,
  MinLength,
} from 'class-validator';

export class OnboardTenantDto {
  @IsString()
  @IsNotEmpty()
  shopName: string;

  @IsIn(['medical', 'grocery', 'retail', 'restaurant', 'electronics', 'clothing', 'other'])
  shopType: string;

  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  phone: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsOptional()
  address?: {
    line1: string;
    city: string;
    pincode: string;
  };

  @IsOptional()
  @IsIn(['starter', 'growth', 'enterprise'])
  plan?: string;

}
