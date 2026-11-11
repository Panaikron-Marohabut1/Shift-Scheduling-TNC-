import { Body, Controller, Get, Inject, Put, Req } from '@nestjs/common';
import { ActorRequest } from '../auth/access.guard';
import { SwapQuotaService } from './swap-quota.service';

@Controller('api/settings/swap-quota')
export class SwapQuotaController {
  constructor(@Inject(SwapQuotaService) private readonly quota: SwapQuotaService) {}

  @Get()
  read(@Req() request: ActorRequest) {
    return this.quota.read(request.actor);
  }

  @Put()
  schedule(@Req() request: ActorRequest, @Body() body: { monthlyLimit?: unknown; expectedEffectiveMonth?: unknown; expectedRevision?: unknown }) {
    return this.quota.schedule(request.actor, body?.monthlyLimit, body?.expectedEffectiveMonth, body?.expectedRevision);
  }
}
