import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GrcPage } from './grc.page';

const routes: Routes = [
  {
    path: '',
    component: GrcPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GrcPageRoutingModule {}
