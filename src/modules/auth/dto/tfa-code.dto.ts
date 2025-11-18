import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class TfaCodeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'El código TFA debe tener 6 dígitos.' })
  code: string;
}
