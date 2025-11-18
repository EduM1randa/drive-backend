import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { RegisterUserDto } from '../auth/dto/register.dto';

@Injectable()
/**
 * Servicio de usuarios.
 */
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  /**
   * Crea un perfil de usuario en MongoDB.
   *
   * @param firebaseUid UID del usuario en Firebase Auth
   * @param email Correo electrónico del usuario
   * @param dto Datos adicionales del usuario (username, fullName, phone)
   * @returns El documento del perfil de usuario creado
   * @throws `ConflictException` si el username o email ya existen
   * @throws `InternalServerErrorException` para otros errores de base de datos
   */
  async createProfile(
    firebaseUid: string,
    email: string,
    dto: RegisterUserDto,
  ): Promise<UserDocument> {
    const profileData = {
      firebaseUid,
      email: email.toLowerCase(),
      username: dto.username.toLowerCase(),
      fullName: dto.fullName,
      phone: dto.phone,
    };

    try {
      const created = new this.userModel(profileData);
      return await created.save();
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new ConflictException(`El ${field} ya está en uso.`);
      }
      throw new InternalServerErrorException(
        `Error al insertar en MongoDB: ${error.message}`,
      );
    }
  }

  /**
   * Busca un perfil de usuario por su email.
   *
   * Selecciona los campos necesarios para el flujo de recuperación
   * (`resetPasswordCode`, `resetPasswordExpires`).
   *
   * @param email Email a buscar
   * @returns `UserDocument` o `null` si no existe
   */
  async findProfileByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+resetPasswordCode +resetPasswordExpires')
      .exec();
  }

  /**
   * Busca un perfil por Firebase UID y lo actualiza.
   *
   * Usado para el rollback tras fallos de creación o para actualizar
   * campos del perfil (p.ej. `tfaSecret`, `isTfaEnabled`, `resetPasswordCode`).
   *
   * @param firebaseUid UID de Firebase
   * @param updateData Campos a actualizar
   * @returns Perfil actualizado
   * @throws `NotFoundException` si no se encuentra el perfil
   */
  async updateProfileByFirebaseUid(
    firebaseUid: string,
    updateData: Partial<User>,
  ): Promise<UserDocument> {
    const updatedProfile = await this.userModel
      .findOneAndUpdate({ firebaseUid }, { $set: updateData }, { new: true })
      .exec();

    if (!updatedProfile) {
      throw new NotFoundException(
        `Perfil con UID ${firebaseUid} no encontrado.`,
      );
    }
    return updatedProfile;
  }

  /**
   * Comprueba si un username ya existe (normalizado a lowercase).
   *
   * @param username Nombre de usuario a comprobar
   * @returns `true` si existe, `false` en caso contrario
   */
  async isUsernameTaken(username: string): Promise<boolean> {
    if (!username) return false;
    const normalized = username.toLowerCase();
    const exists = await this.userModel.exists({ username: normalized });
    return !!exists;
  }

  /**
   * Genera y persiste un código de recuperación para el email dado.
   *
   * @param email Email del usuario
   * @returns Documento de usuario actualizado con `resetPasswordCode`
   * @throws `NotFoundException` si el email no está registrado
   */
  async generatePasswordReset(email: string): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+resetPasswordCode +resetPasswordExpires')
      .exec();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const code = `${Math.floor(100000 + Math.random() * 900000)}`;
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    user.resetPasswordCode = code;
    user.resetPasswordExpires = expires;

    await user.save();
    return user;
  }

  /**
   * Busca un usuario por su Firebase UID.
   *
   * @param firebaseUid UID de Firebase
   * @returns `UserDocument` o `null` si no existe
   */
  async findOneByUid(firebaseUid: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ firebaseUid }).exec();
  }
}
