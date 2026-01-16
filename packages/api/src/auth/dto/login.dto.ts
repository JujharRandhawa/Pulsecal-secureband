import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  jailName!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password!: string;
}
