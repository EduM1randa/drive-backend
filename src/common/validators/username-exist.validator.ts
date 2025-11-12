import { Injectable } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../modules/users/schemas/user.schema';

@ValidatorConstraint({ async: true })
@Injectable()
export class IsUsernameAvailable implements ValidatorConstraintInterface {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async validate(username: string): Promise<boolean> {
    if (!username) return false;
    const exists = await this.userModel.exists({ username });
    return !exists;
  }

  defaultMessage(): string {
    return 'El nombre de usuario ya está en uso.';
  }
}
