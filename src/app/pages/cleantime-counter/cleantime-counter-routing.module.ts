import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CleantimeCounterPage } from './cleantime-counter.page';

const routes: Routes = [
  {
    path: '',
    component: CleantimeCounterPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CleantimeCounterPageRoutingModule {}
